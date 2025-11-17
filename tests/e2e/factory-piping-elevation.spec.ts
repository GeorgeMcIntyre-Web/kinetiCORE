/**
 * Factory Piping Elevation - End-to-End Tests
 *
 * Owner: Agent 8 (E2E Test Specialist)
 * Date: 2025-11-15
 * Integration Baseline: 5d407bf (Agent 2 + Agent 4 merged to main)
 *
 * Tests real user workflows for elevation-aware node placement in the
 * Factory Piping system.
 *
 * Run with: npm run test:e2e
 */

import { test, expect, Page } from '@playwright/test';
import {
  ensureProfessionalMode,
  openPipingPanel,
  waitForPipingPanelReady,
  waitForSceneReady,
  getPlacementMode,
  getDefaultElevation,
  setPlacementMode,
  setDefaultElevation,
  placeNodeAtViewport,
  getNodeCount,
  getNodeElevation,
  getValidationErrors,
  pause,
  assertCloseToExpected,
} from './utils/pipingElevationHelpers';

test.describe('Factory Piping - Elevation Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for it to load
    await page.goto('http://localhost:5173');
    await waitForSceneReady(page);

    // Switch to Professional mode where Piping toolbar is available
    await ensureProfessionalMode(page);
  });

  test('[E2E-ELEV-001] Happy Path - Default placement workflow', async ({ page }) => {
    // Step 1: Open Piping panel
    await openPipingPanel(page);
    await waitForPipingPanelReady(page);

    // Step 2: Verify default placement mode and elevation
    const initialMode = await getPlacementMode(page);
    const initialElevation = await getDefaultElevation(page);

    // Expect either 'at_elevation' or 'on_floor' based on defaults
    expect(['at_elevation', 'on_floor']).toContain(initialMode);

    // Default elevation should be a finite number >= 0
    expect(initialElevation).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(initialElevation)).toBe(true);

    // Step 3: Place a node
    await placeNodeAtViewport(page, 0.5, 0.5);

    // Step 4: Verify node was created
    const nodeCount = await getNodeCount(page);
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Step 5: Read node's elevation and verify it matches default
    const nodeElevation = await getNodeElevation(page, 0);

    // For 'at_elevation', elevation should match default
    // For 'on_floor', elevation will be based on floor hit (may be ~0.0)
    if (initialMode === 'at_elevation') {
      assertCloseToExpected(nodeElevation, initialElevation, 0.1);
    }

    if (initialMode === 'on_floor') {
      // Floor is at ~0.0, so node should be near ground level
      expect(nodeElevation).toBeLessThan(1.0);
    }

    // Step 6: Verify no validation errors
    const errors = await getValidationErrors(page);
    expect(errors.length).toBe(0);
  });

  test('[E2E-ELEV-002] Mode Switching - Floor → Fixed Height → At Elevation', async ({ page }) => {
    // Step 1: Open Piping panel
    await openPipingPanel(page);
    await waitForPipingPanelReady(page);

    // Step 2: Set mode to 'on_floor' and place Node A
    await setPlacementMode(page, 'on_floor');
    await placeNodeAtViewport(page, 0.3, 0.4);
    const nodeA_elevation = await getNodeElevation(page, 0);

    // Node A should be at or near floor level (0.0m or close)
    expect(nodeA_elevation).toBeLessThan(1.0);

    // Step 3: Stay in 'on_floor' mode and place another node at different location
    await placeNodeAtViewport(page, 0.5, 0.5);
    const nodeB_elevation = await getNodeElevation(page, 1);

    // Node B should also be at or near floor level
    expect(nodeB_elevation).toBeLessThan(1.0);

    // Step 4: Switch to 'at_elevation' mode with 2.0m elevation
    await setPlacementMode(page, 'at_elevation');
    await setDefaultElevation(page, 2.0);

    // Verify settings applied
    const modeAfterSwitch = await getPlacementMode(page);
    const elevationAfterSwitch = await getDefaultElevation(page);
    expect(modeAfterSwitch).toBe('at_elevation');
    assertCloseToExpected(elevationAfterSwitch, 2.0, 0.01);

    // Place Node C
    await placeNodeAtViewport(page, 0.7, 0.6);
    const nodeC_elevation = await getNodeElevation(page, 2);

    // Node C should be at 2.0m
    assertCloseToExpected(nodeC_elevation, 2.0, 0.1);

    // Step 5: Switch to 3.5m elevation
    await setDefaultElevation(page, 3.5);
    assertCloseToExpected(await getDefaultElevation(page), 3.5, 0.01);

    // Place Node D
    await placeNodeAtViewport(page, 0.8, 0.7);
    const nodeD_elevation = await getNodeElevation(page, 3);

    // Node D should be at 3.5m
    assertCloseToExpected(nodeD_elevation, 3.5, 0.1);

    // Step 6: Verify at least four nodes exist (may have more from previous tests)
    const finalNodeCount = await getNodeCount(page);
    expect(finalNodeCount).toBeGreaterThanOrEqual(4);

    // Step 7: Verify relative ordering
    expect(nodeA_elevation).toBeLessThan(nodeC_elevation);
    expect(nodeC_elevation).toBeLessThan(nodeD_elevation);
  });

  test('[E2E-ELEV-003] Validation - Invalid elevation inputs', async ({ page }) => {
    // Step 1: Open Piping panel
    await openPipingPanel(page);
    await waitForPipingPanelReady(page);

    // Step 2: Set mode to 'at_elevation'
    await setPlacementMode(page, 'at_elevation');

    // Set up console error listener BEFORE any actions
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 3: Try invalid inputs and verify no crashes
    const elevationInput = page.locator('[data-testid="placement-elevation-input"]');
    await expect(elevationInput).toBeVisible();

    // Test 3a: Empty string (should revert or use fallback)
    await elevationInput.fill('');
    await elevationInput.blur();
    await pause(200); // Wait for blur to complete

    // Test 3b: Non-numeric text (use evaluate since input[type=number] rejects fill('abc'))
    await elevationInput.evaluate((el: HTMLInputElement) => {
      el.value = 'abc';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await pause(200);

    // Field should reject or clear invalid input
    const valueAfterInvalid = await elevationInput.inputValue();
    // Either empty or a valid fallback number
    if (valueAfterInvalid !== '') {
      const parsed = parseFloat(valueAfterInvalid);
      expect(Number.isFinite(parsed)).toBe(true);
    }

    // Test 3c: Negative value
    await elevationInput.fill('-5.0');
    await elevationInput.blur();

    // Store may clamp or reject - verify no crash
    const valueAfterNegative = await elevationInput.inputValue();
    if (valueAfterNegative !== '') {
      const parsed = parseFloat(valueAfterNegative);
      // If store allows negatives, that's fine; if not, should be >= 0
      // For now, just ensure it's finite
      expect(Number.isFinite(parsed)).toBe(true);
    }

    // Test 3d: Extremely large value
    await elevationInput.fill('999999');
    await elevationInput.blur();

    // Store may clamp - verify no crash
    const valueAfterLarge = await elevationInput.inputValue();
    if (valueAfterLarge !== '') {
      const parsed = parseFloat(valueAfterLarge);
      expect(Number.isFinite(parsed)).toBe(true);
    }

    // Step 4: Set a safe valid value and place a node
    await setDefaultElevation(page, 1.5);
    await placeNodeAtViewport(page, 0.5, 0.5);

    // Verify node was created with a valid elevation
    const nodeElevation = await getNodeElevation(page, 0);
    expect(Number.isFinite(nodeElevation)).toBe(true);
    expect(nodeElevation).toBeGreaterThanOrEqual(0);

    // Step 5: Verify no console errors occurred
    expect(consoleErrors.length).toBe(0);
  });

  test('[E2E-ELEV-004] Regression - Non-piping features still work', async ({ page }) => {
    // This is a lightweight regression check
    // Goal: Ensure opening Piping panel doesn't break basic app functionality

    // Step 1: Open Piping panel
    await openPipingPanel(page);
    await waitForPipingPanelReady(page);

    // Step 2: Place one piping node
    await setPlacementMode(page, 'at_elevation');
    await setDefaultElevation(page, 1.0);
    await placeNodeAtViewport(page, 0.5, 0.5);

    // Step 3: Close Piping panel (using helper which has built-in wait)
    const panel = page.locator('[data-testid="piping-panel"]');
    const closeButton = panel.locator('button[title="Close Piping Panel"]');
    await closeButton.click();

    // Wait for panel to be hidden
    await expect(panel).toBeHidden({ timeout: 3000 });

    // Step 4: Verify panel is closed
    await expect(panel).not.toBeVisible();

    // Step 5: Re-open Piping panel and verify data persists
    await openPipingPanel(page);
    await waitForPipingPanelReady(page);

    const nodeCountAfterReopen = await getNodeCount(page);
    expect(nodeCountAfterReopen).toBeGreaterThanOrEqual(1);

    // Verify settings persisted
    const modeAfterReopen = await getPlacementMode(page);
    const elevationAfterReopen = await getDefaultElevation(page);
    expect(modeAfterReopen).toBe('at_elevation');
    assertCloseToExpected(elevationAfterReopen, 1.0, 0.01);

    // Verify the first node still has the expected elevation
    const firstNodeElevation = await getNodeElevation(page, 0);
    assertCloseToExpected(firstNodeElevation, 1.0, 0.1);
  });
});
