/**
 * U112 Motion Panel E2E Test
 *
 * Tests the Motion Panel control for U112 hinge joint in a real browser with WebGL.
 *
 * Scenario: Load fitted U112 state → Open Motion Panel → Control slider
 * Expected: Slider controls U112 hinge angle [0°, 90°]
 *
 * See: docs/auto-kinematics/U112_MOTION_PANEL_GOLD.md
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Helper: Wait for app initialization
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });
  await page.waitForSelector('#initial-splash', { state: 'hidden', timeout: 15000 });
  await page.waitForSelector('.layout-container', { state: 'visible', timeout: 10000 });
}

/**
 * Helper: Load pre-fitted U112 state
 * In a real test, this would either:
 * - Run the full pipeline (slow)
 * - Load a saved state/snapshot (fast)
 * - Use a test fixture endpoint
 */
async function loadFittedU112State(page: Page): Promise<void> {
  // Try to use test helper to load pre-fitted state
  try {
    await page.evaluate(async () => {
      const win = window as any;
      if (!win.__ToolingTestHelper__) {
        throw new Error('__ToolingTestHelper__ not available');
      }
      await win.__ToolingTestHelper__.u112.loadAutoFittedState();
    });
    await page.waitForTimeout(1000);
  } catch (error) {
    // Fallback: Test helper not fully implemented yet
    // For now, tests should use the full UI workflow
    throw new Error(
      'loadAutoFittedState() not implemented. Use full UI workflow (Analyze → Capture → Fit) instead.'
    );
  }
}

/**
 * Helper: Open Motion Panel
 */
async function openMotionPanel(page: Page): Promise<void> {
  const motionPanelButton = page.getByTestId('open-motion-panel');

  if (!await motionPanelButton.isVisible()) {
    throw new Error('Motion Panel button not found. Add data-testid="open-motion-panel".');
  }

  await motionPanelButton.click();

  // Wait for panel to open
  await page.waitForSelector('[data-testid="motion-panel"]', { state: 'visible', timeout: 5000 });
}

test.describe('U112 GOLD Motion Panel Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should display U112 tooling slider in Motion Panel', async ({ page }) => {
    // Skip if test helper not available
    test.skip(!process.env.U112_TEST_HELPER_AVAILABLE, 'U112 test helper not available');

    // Load fitted U112 state
    await loadFittedU112State(page);

    // Open Motion Panel
    await openMotionPanel(page);

    // Scroll to Tooling Motion section
    const toolingMotionSection = page.getByTestId('motion-panel-tooling-section');
    if (!await toolingMotionSection.isVisible()) {
      throw new Error('Tooling Motion section not found in Motion Panel.');
    }

    await toolingMotionSection.scrollIntoViewIfNeeded();

    // Find U112 slider
    const u112Slider = page.getByTestId('tooling-motion-slider-u112');
    await expect(u112Slider).toBeVisible();

    // Verify slider properties
    const sliderMin = await u112Slider.getAttribute('min');
    const sliderMax = await u112Slider.getAttribute('max');
    const sliderValue = await u112Slider.getAttribute('value');

    expect(sliderMin).toBe('0');
    expect(parseFloat(sliderMax!)).toBeGreaterThanOrEqual(85); // Should be ~90°
    expect(parseFloat(sliderMax!)).toBeLessThanOrEqual(95);
    expect(sliderValue).toBe('0'); // Initial value should be 0°
  });

  test('should control U112 hinge angle with slider', async ({ page }) => {
    test.skip(!process.env.U112_TEST_HELPER_AVAILABLE, 'U112 test helper not available');

    // Load fitted U112 state
    await loadFittedU112State(page);

    // Open Motion Panel
    await openMotionPanel(page);

    // Find U112 slider
    const u112Slider = page.getByTestId('tooling-motion-slider-u112');
    if (!await u112Slider.isVisible()) {
      throw new Error('U112 slider not visible.');
    }

    // Step 1: Verify initial state (0°)
    const initialValue = await u112Slider.getAttribute('value');
    expect(initialValue).toBe('0');

    // Step 2: Get current clamp transform
    const initialTransform = await page.evaluate(async () => {
      const win = window as any;
      if (!win.__ToolingTestHelper__) {
        throw new Error('__ToolingTestHelper__ not available');
      }
      return await win.__ToolingTestHelper__.u112.getClampTransform();
    });

    if (!initialTransform || !initialTransform.position || !initialTransform.rotation) {
      throw new Error('Could not get initial clamp transform.');
    }

    // Step 3: Move slider to ~45°
    const sliderMax = await u112Slider.getAttribute('max');
    const targetAngle = parseFloat(sliderMax!) / 2; // Mid-point

    await u112Slider.fill(targetAngle.toString());
    await page.waitForTimeout(500);

    // Step 4: Verify slider value updated
    const updatedValue = await u112Slider.getAttribute('value');
    expect(parseFloat(updatedValue!)).toBeCloseTo(targetAngle, 1);

    // Step 5: Verify clamp transform changed
    const updatedTransform = await page.evaluate(async () => {
      const win = window as any;
      if (!win.__ToolingTestHelper__) {
        throw new Error('__ToolingTestHelper__ not available');
      }
      return await win.__ToolingTestHelper__.u112.getClampTransform();
    });

    if (!updatedTransform || !updatedTransform.position || !updatedTransform.rotation) {
      throw new Error('Could not get updated clamp transform.');
    }

    // Transform should have changed (rotation applied)
    const transformChanged =
      initialTransform.rotation[0] !== updatedTransform.rotation[0] ||
      initialTransform.rotation[1] !== updatedTransform.rotation[1] ||
      initialTransform.rotation[2] !== updatedTransform.rotation[2];

    expect(transformChanged).toBe(true);

    // Step 6: Move slider to max (~90°)
    await u112Slider.fill(sliderMax!);
    await page.waitForTimeout(500);

    const maxValue = await u112Slider.getAttribute('value');
    expect(parseFloat(maxValue!)).toBeCloseTo(parseFloat(sliderMax!), 1);

    // Step 7: Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(500);

    // Filter out non-critical errors (e.g., React DevTools warnings)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('React DevTools') &&
      !err.includes('Download the React DevTools')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should display slider label and current value', async ({ page }) => {
    test.skip(!process.env.U112_TEST_HELPER_AVAILABLE, 'U112 test helper not available');

    await loadFittedU112State(page);
    await openMotionPanel(page);

    // Find slider container
    const sliderContainer = page.locator('[data-testid="tooling-motion-slider-u112"]').locator('..');

    // Should have a label
    const label = sliderContainer.locator('label, .slider-label').first();
    await expect(label).toBeVisible();
    await expect(label).toContainText(/UNIT_112|U112|Hinge/i);

    // Should display current value
    const valueDisplay = sliderContainer.getByTestId('slider-value-u112');
    await expect(valueDisplay).toBeVisible();

    // Value should update when slider moves
    const slider = page.getByTestId('tooling-motion-slider-u112');
    await slider.fill('45');
    await page.waitForTimeout(300);

    const valueText = await valueDisplay.textContent();
    expect(valueText).toContain('45');
  });

  test('should respect slider limits', async ({ page }) => {
    test.skip(!process.env.U112_TEST_HELPER_AVAILABLE, 'U112 test helper not available');

    await loadFittedU112State(page);
    await openMotionPanel(page);

    const slider = page.getByTestId('tooling-motion-slider-u112');

    // Try to set value below min
    await slider.fill('-10');
    await page.waitForTimeout(300);

    const valueBelowMin = await slider.getAttribute('value');
    expect(parseFloat(valueBelowMin!)).toBeGreaterThanOrEqual(0);

    // Try to set value above max
    await slider.fill('120');
    await page.waitForTimeout(300);

    const valueAboveMax = await slider.getAttribute('value');
    const maxValue = await slider.getAttribute('max');
    expect(parseFloat(valueAboveMax!)).toBeLessThanOrEqual(parseFloat(maxValue!));
  });
});
