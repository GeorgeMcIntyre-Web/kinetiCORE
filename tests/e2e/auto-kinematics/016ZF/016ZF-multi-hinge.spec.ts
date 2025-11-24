/**
 * 016ZF Multi-Hinge E2E Tests
 *
 * Tests the auto-kinematics pipeline with a full 4-hinge fixture:
 * - 016ZF_20142435_140_1E1_CI00.glb (4 moving clamps, 4 hinge joints)
 *
 * Prerequisites:
 * - kinetiCORE dev server running at http://localhost:5173
 * - 016ZF fixture GLB available at expected path
 *
 * Run with: npx playwright test tests/e2e/auto-kinematics/016ZF/
 */

import { test, expect, Page } from '@playwright/test';

// Test fixture path (external data directory)
const FIXTURE_PATH = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\8X-140-1E1_LH\\016ZF_20142435_140_1E1_CI00.glb';

// Wait for app to be fully loaded
async function waitForAppReady(page: Page): Promise<void> {
  // Wait for scene canvas to be visible
  await page.waitForSelector('[data-testid="scene-canvas"], canvas', { timeout: 30000 });

  // Wait for React to hydrate
  await page.waitForTimeout(2000);

  // Wait for test helper to be available
  await page.waitForFunction(
    () => typeof (window as any).__ToolingTestHelper__ !== 'undefined',
    { timeout: 10000 }
  );
}

// Load a GLB fixture via file picker simulation
async function loadFixture(page: Page, fixturePath: string): Promise<void> {
  // Use file chooser API
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('[data-testid="import-glb-button"], button:has-text("Import"), button:has-text("Load")')
  ]);

  await fileChooser.setFiles(fixturePath);

  // Wait for loading to complete
  await page.waitForTimeout(3000);
}

test.describe('016ZF Multi-Hinge Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    await waitForAppReady(page);
  });

  test('detects 4 moving units after analysis', async ({ page }) => {
    // Skip if fixture not available (CI environment)
    test.skip(!require('fs').existsSync(FIXTURE_PATH), '016ZF fixture not available');

    // Load fixture
    await loadFixture(page, FIXTURE_PATH);

    // Open Tooling Fixture Animator panel
    await page.click('[data-testid="tooling-animator-panel"], button:has-text("Tooling")');

    // Click Analyze button
    await page.click('[data-testid="animator-analyze-button"]');

    // Wait for analysis to complete
    await page.waitForSelector('[data-testid="moving-unit-indicator"]', { timeout: 10000 });

    // Get moving unit count from test helper
    const movingUnitCount = await page.evaluate(() => {
      const helper = (window as any).__ToolingTestHelper__;
      return helper.multiHinge.getMovingUnitCount();
    });

    expect(movingUnitCount).toBe(4);
  });

  test('fits 4 hinge joints with valid angles', async ({ page }) => {
    // Skip if fixture not available
    test.skip(!require('fs').existsSync(FIXTURE_PATH), '016ZF fixture not available');

    // Load fixture
    await loadFixture(page, FIXTURE_PATH);

    // Open Tooling Fixture Animator panel
    await page.click('[data-testid="tooling-animator-panel"], button:has-text("Tooling")');

    // Run full pipeline
    await page.click('[data-testid="animator-analyze-button"]');
    await page.waitForTimeout(1000);

    await page.click('[data-testid="capture-retracted-button"]');
    await page.waitForTimeout(500);

    // Set all clamps to extended pose
    await page.evaluate(async () => {
      const helper = (window as any).__ToolingTestHelper__;
      await helper.multiHinge.setAllClampsExtended();
    });
    await page.waitForTimeout(500);

    await page.click('[data-testid="capture-extended-button"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="fit-joints-button"]');
    await page.waitForTimeout(2000);

    // Get joint info
    const jointInfo = await page.evaluate(() => {
      const helper = (window as any).__ToolingTestHelper__;
      return helper.multiHinge.getJointInfo();
    });

    // Assert: 4 hinge joints
    expect(jointInfo.length).toBe(4);

    // Assert: Each joint has angle in valid range (80-100°)
    for (const joint of jointInfo) {
      expect(joint.type).toBe('revolute');
      expect(joint.angleDeg).toBeGreaterThan(80);
      expect(joint.angleDeg).toBeLessThan(100);
    }
  });

  test('Motion Panel shows All Clamps slider with 4 individual sliders', async ({ page }) => {
    // Skip if fixture not available
    test.skip(!require('fs').existsSync(FIXTURE_PATH), '016ZF fixture not available');

    // Load fixture and run auto-fit
    await loadFixture(page, FIXTURE_PATH);

    await page.click('[data-testid="tooling-animator-panel"], button:has-text("Tooling")');
    await page.click('[data-testid="animator-analyze-button"]');
    await page.waitForTimeout(1000);

    await page.click('[data-testid="capture-retracted-button"]');
    await page.waitForTimeout(500);

    await page.evaluate(async () => {
      const helper = (window as any).__ToolingTestHelper__;
      await helper.multiHinge.setAllClampsExtended();
    });

    await page.click('[data-testid="capture-extended-button"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="fit-joints-button"]');
    await page.waitForTimeout(2000);

    // Open Motion Panel
    await page.click('button:has-text("Motion")');
    await page.waitForSelector('[data-testid="motion-panel"]', { timeout: 5000 });

    // Verify Tooling Motion section exists
    await expect(page.locator('[data-testid="motion-panel-tooling-section"]')).toBeVisible();

    // Verify All Clamps slider exists
    await expect(page.locator('[data-testid="tooling-motion-slider-all-clamps"]')).toBeVisible();

    // Verify individual joint sliders exist (at least 4)
    const sliders = page.locator('input[data-testid^="tooling-motion-slider-"]');
    const sliderCount = await sliders.count();

    // Should have 5 sliders: 1 All Clamps + 4 individual
    expect(sliderCount).toBeGreaterThanOrEqual(5);
  });

  test('All Clamps slider moves all joints simultaneously', async ({ page }) => {
    // Skip if fixture not available
    test.skip(!require('fs').existsSync(FIXTURE_PATH), '016ZF fixture not available');

    // Load and fit fixture (same as above)
    await loadFixture(page, FIXTURE_PATH);

    await page.click('[data-testid="tooling-animator-panel"], button:has-text("Tooling")');
    await page.click('[data-testid="animator-analyze-button"]');
    await page.waitForTimeout(1000);

    await page.click('[data-testid="capture-retracted-button"]');
    await page.waitForTimeout(500);

    await page.evaluate(async () => {
      const helper = (window as any).__ToolingTestHelper__;
      await helper.multiHinge.setAllClampsExtended();
    });

    await page.click('[data-testid="capture-extended-button"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="fit-joints-button"]');
    await page.waitForTimeout(2000);

    // Open Motion Panel
    await page.click('button:has-text("Motion")');
    await page.waitForSelector('[data-testid="motion-panel"]', { timeout: 5000 });

    // Get initial transforms
    const initialTransforms = await page.evaluate(async () => {
      const helper = (window as any).__ToolingTestHelper__;
      return helper.multiHinge.getAllClampTransforms();
    });

    // Move All Clamps slider to 50%
    const allClampsSlider = page.locator('[data-testid="tooling-motion-slider-all-clamps"]');
    await allClampsSlider.fill('0.5');
    await page.waitForTimeout(500);

    // Get new transforms
    const newTransforms = await page.evaluate(async () => {
      const helper = (window as any).__ToolingTestHelper__;
      return helper.multiHinge.getAllClampTransforms();
    });

    // Assert: All clamps moved (at least one rotation component changed)
    for (let i = 0; i < initialTransforms.length; i++) {
      const initial = initialTransforms[i];
      const current = newTransforms[i];

      // At least one rotation value should be different
      const rotationChanged =
        Math.abs(initial.rotation[0] - current.rotation[0]) > 0.01 ||
        Math.abs(initial.rotation[1] - current.rotation[1]) > 0.01 ||
        Math.abs(initial.rotation[2] - current.rotation[2]) > 0.01;

      expect(rotationChanged).toBe(true);
    }
  });
});

test.describe('016ZF vs U112 Compatibility', () => {
  test('U112 GOLD pipeline still works after multi-hinge changes', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    await waitForAppReady(page);

    // This test simply verifies U112 test helper methods are still available
    const helperAvailable = await page.evaluate(() => {
      const helper = (window as any).__ToolingTestHelper__;
      return (
        typeof helper?.u112?.setExtendedPose === 'function' &&
        typeof helper?.u112?.getClampTransform === 'function' &&
        typeof helper?.multiHinge?.getMovingUnitCount === 'function'
      );
    });

    expect(helperAvailable).toBe(true);
  });
});
