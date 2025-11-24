/**
 * U112 Auto-Kinematics Pipeline E2E Test
 *
 * Tests the complete U112 GOLD auto-fit pipeline in a real browser with WebGL.
 *
 * Scenario: Load U112 fixture → Analyze → Capture poses → Fit joints
 * Expected: 1 hinge joint detected with ~90° range
 *
 * See: docs/auto-kinematics/U112_MOTION_PANEL_GOLD.md
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Helper: Wait for app initialization
 */
async function waitForAppReady(page: Page): Promise<void> {
  // Wait for React root to be mounted
  await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });

  // Wait for splash screen to disappear
  await page.waitForSelector('#initial-splash', { state: 'hidden', timeout: 15000 });

  // Wait for main layout to be visible
  await page.waitForSelector('.layout-container', { state: 'visible', timeout: 10000 });
}

/**
 * Helper: Load U112 GLB fixture via file input
 */
async function loadU112Fixture(page: Page): Promise<void> {
  // Look for file input or asset library trigger
  // This is a placeholder - adjust based on actual UI structure
  const fileInput = page.locator('input[type="file"]').first();

  if (!await fileInput.isVisible()) {
    // Try opening asset library or file menu
    const assetLibraryButton = page.getByTestId('open-asset-library');
    if (await assetLibraryButton.isVisible()) {
      await assetLibraryButton.click();
    }
  }

  // Set the file path
  const u112FixturePath = 'fixtures/016ZF_20142435_140_1E1_CI00_U112.glb';
  await fileInput.setInputFiles(u112FixturePath);

  // Wait for model to load
  await page.waitForTimeout(2000);
}

/**
 * Helper: Open Tooling Fixture Animator Panel
 */
async function openAnimatorPanel(page: Page): Promise<void> {
  const animatorButton = page.getByTestId('open-tooling-animator');

  if (!await animatorButton.isVisible()) {
    throw new Error('Tooling Animator button not found. Add data-testid="open-tooling-animator" to the UI.');
  }

  await animatorButton.click();

  // Wait for panel to open
  await page.waitForSelector('[data-testid="tooling-animator-panel"]', { state: 'visible', timeout: 5000 });
}

test.describe('U112 GOLD Auto-Kinematics Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should auto-fit U112 hinge joint with ~90° range', async ({ page }) => {
    // Skip if fixture file doesn't exist
    // In CI, this test should be skipped or fixture should be provided
    test.skip(!process.env.U112_FIXTURE_AVAILABLE, 'U112 fixture not available');

    // Step 1: Load U112 fixture
    await loadU112Fixture(page);

    // Step 2: Open Tooling Fixture Animator Panel
    await openAnimatorPanel(page);

    // Step 3: Click "Analyze" button
    const analyzeButton = page.getByTestId('animator-analyze-button');
    if (!await analyzeButton.isVisible()) {
      throw new Error('Analyze button not found. Add data-testid="animator-analyze-button".');
    }
    await analyzeButton.click();

    // Wait for analysis to complete
    await page.waitForTimeout(1000);

    // Step 4: Verify units detected (UNIT_101 fixed, UNIT_112 moving)
    const fixedUnitIndicator = page.getByTestId('fixed-unit-indicator');
    const movingUnitIndicator = page.getByTestId('moving-unit-indicator');

    await expect(fixedUnitIndicator).toContainText('UNIT_101');
    await expect(movingUnitIndicator).toContainText('UNIT_112');

    // Step 5: Capture Retracted pose
    const captureRetractedButton = page.getByTestId('capture-retracted-button');
    if (!await captureRetractedButton.isVisible()) {
      throw new Error('Capture Retracted button not found.');
    }
    await captureRetractedButton.click();
    await page.waitForTimeout(500);

    // Step 6: Move clamp to extended pose using test helper
    await page.evaluate(async () => {
      const win = window as any;
      if (!win.__ToolingTestHelper__) {
        throw new Error('__ToolingTestHelper__ not available. Is app in dev mode?');
      }
      await win.__ToolingTestHelper__.u112.setExtendedPose();
    });
    await page.waitForTimeout(500);

    // Step 7: Capture Extended pose
    const captureExtendedButton = page.getByTestId('capture-extended-button');
    if (!await captureExtendedButton.isVisible()) {
      throw new Error('Capture Extended button not found.');
    }
    await captureExtendedButton.click();
    await page.waitForTimeout(500);

    // Step 8: Fit Joints
    const fitJointsButton = page.getByTestId('fit-joints-button');
    if (!await fitJointsButton.isVisible()) {
      throw new Error('Fit Joints button not found.');
    }
    await fitJointsButton.click();

    // Wait for joint fitting to complete
    await page.waitForTimeout(2000);

    // Step 9: Verify results
    const jointCountIndicator = page.getByTestId('fitted-joints-count');
    await expect(jointCountIndicator).toContainText('1');

    const jointAngleIndicator = page.getByTestId('joint-angle-u112');
    const angleText = await jointAngleIndicator.textContent();

    if (!angleText) {
      throw new Error('Joint angle indicator not found or empty.');
    }

    // Extract angle value (e.g., "90°" or "90 degrees")
    const angleMatch = angleText.match(/(\d+\.?\d*)/);
    if (!angleMatch) {
      throw new Error(`Could not parse angle from: ${angleText}`);
    }

    const angle = parseFloat(angleMatch[1]);
    expect(angle).toBeGreaterThanOrEqual(85);
    expect(angle).toBeLessThanOrEqual(95);

    // Step 10: Verify no fatal errors
    const errorToast = page.locator('[data-testid="error-toast"]');
    await expect(errorToast).not.toBeVisible();
  });

  test('should handle missing fixture gracefully', async ({ page }) => {
    // This test verifies error handling when fixture is not available
    await openAnimatorPanel(page);

    const analyzeButton = page.getByTestId('animator-analyze-button');

    // If no model is loaded, analyze should either be disabled or show an error
    if (await analyzeButton.isVisible()) {
      const isDisabled = await analyzeButton.isDisabled();

      if (!isDisabled) {
        // If button is enabled despite no model, clicking should show error
        await analyzeButton.click();

        // Should see error message
        const errorMessage = page.locator('[data-testid="animator-error-message"]');
        await expect(errorMessage).toBeVisible();
      }
    }
  });
});
